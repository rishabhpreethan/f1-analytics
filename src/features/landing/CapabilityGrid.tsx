import { Link } from 'react-router';
import { ArrowRight } from '@/components/ui/icons';
import { useSectionReveal } from '@/lib/motion/scroll';
import { useTilt } from '@/lib/motion/interactions';

/**
 * Section B — the capability grid (§3.4).
 *
 * Six cards, one per destination, each the whole card as a single `<a>` so the hit area is the
 * card rather than the title. The `In build` chip is present **only while the destination is a
 * placeholder** and disappears with the feature that replaces it — a chip that outlives its
 * reason is worse than no chip.
 *
 * ---
 *
 * **The hover was rebuilt 2026-08-06.** Rishabh: *"even the hover effects for these cards … i
 * dont really like them either."*
 *
 * What it was: a pointer spotlight (G-8), a 2px `y` lift, the top edge recolouring, and the arrow
 * nudging 3px. **Four small polite effects layered on one element** — which is legible as a
 * template's default hover, and politeness is what has now been rejected three times.
 *
 * What it is: **two committed gestures.**
 *
 *   - **G-25 — a perspective tilt toward the pointer**, ±4°, with a `scale` step and a real
 *     `--elev-2` shadow. The card reads as a physical object rising and turning to face you,
 *     rather than as a rectangle changing colour.
 *   - **G-26 — two accent brackets closing on the card** from opposite corners, like a
 *     viewfinder's crop marks. Sharp, instrument-like, and it works in pure monochrome, which a
 *     14%-opacity glow does not.
 *
 * **G-8 is retired from the product**, not merely from this card: with a monochrome accent a
 * low-opacity achromatic radial over a panel is a smudge — the identical failure the
 * atmosphere's gradient orbs were removed for the same day.
 *
 * Motion: **G-15** reveals the section once on scroll with the cards staggered; **G-25** is the
 * tilt. G-26 and the index / arrow / surface / elevation steps are **CSS keyed on `:hover` and
 * `:focus-visible` together**, so a keyboard user gets everything except the tilt — which is
 * pointer-derived by definition and has nothing to follow. Under `reduce` the tilt is never
 * created and the CSS transitions are stopped by chokepoint 1, which leaves the brackets and the
 * token changes arriving instantly: a state change, which is exactly what §4.6 G-7's reduced
 * column asks for.
 */

interface Capability {
  index: string;
  title: string;
  body: string;
  to: string;
  /** The feature that replaces the placeholder. `null` once the surface is real. */
  inBuild: string | null;
}

/** Design Spec §3.4, verbatim copy. `/seasons` rather than `/season` — see `navItems.ts`. */
const CAPABILITIES: readonly Capability[] = [
  {
    index: '01',
    title: 'Season',
    body: 'The calendar, the standings, and how the championship actually moved round by round.',
    to: '/seasons',
    inBuild: 'F2',
  },
  {
    index: '02',
    title: 'Drivers',
    body: 'Careers, season-by-season form, and the teammate head-to-heads that decide reputations.',
    to: '/drivers',
    inBuild: 'F4',
  },
  {
    index: '03',
    title: 'Teams',
    body: 'Constructor histories, driver line-ups, and the seasons that defined them.',
    to: '/teams',
    inBuild: 'F5',
  },
  {
    index: '04',
    title: 'Circuits',
    body: 'Every venue the championship has visited, and what tends to happen there.',
    to: '/circuits',
    inBuild: 'F6',
  },
  {
    index: '05',
    title: 'Compare',
    body: "Up to four drivers or teams, any season range, one chart that doesn't cheat.",
    to: '/compare',
    inBuild: 'F7',
  },
  {
    index: '06',
    title: 'Records',
    body: 'Cross-era leaderboards, normalised so a 1954 season and a 2024 season can be read side by side.',
    to: '/records',
    inBuild: 'F8',
  },
];

export function CapabilityGrid() {
  const { scope } = useSectionReveal<HTMLElement>();

  return (
    <section
      ref={scope}
      className="shell-container px-4 py-12 md:px-6 xl:px-8"
      aria-labelledby="capability-title"
    >
      <p className="t-2xs text-ink-tertiary flex items-center gap-2" data-motion="reveal-item">
        <span className="accent-rule" aria-hidden="true" />
        WHERE TO GO
      </p>
      <h2
        id="capability-title"
        className="t-display-sm text-ink-primary mt-3"
        data-motion="reveal-item"
      >
        Six ways into the record
      </h2>

      <ul className="capability-grid mt-8">
        {CAPABILITIES.map((capability) => (
          <li key={capability.to} data-motion="reveal-item">
            <CapabilityCard capability={capability} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CapabilityCard({ capability }: { capability: Capability }) {
  const { scope, handlers } = useTilt<HTMLAnchorElement>();

  return (
    <Link ref={scope} to={capability.to} className="capability-card" {...handlers}>
      {/*
       * G-26. Two brackets rather than one traced perimeter: each is a box carrying only two
       * borders, revealed by a `clip-path` transition from its own corner, so the pair closes on
       * the card from opposite ends. Decorative and `aria-hidden` — everything it signals is also
       * signalled by the surface step, the index and the arrow.
       */}
      <span className="capability-bracket" aria-hidden="true" />

      <span className="capability-head">
        {/*
         * `--ink-tertiary` at rest, `--accent-ink` on hover and focus — a real state change. It
         * used to be `--accent-ink` at rest, which a monochrome accent cannot express: `#08090C`
         * beside `--ink-primary` `#1B1E24` is ΔE ≈ 5, so the index and the title read as one flat
         * block of type (§3.6.1).
         */}
        <span className="capability-index t-mono t-display-md">{capability.index}</span>
        {capability.inBuild !== null && (
          <span className="chip t-2xs capability-chip">In build</span>
        )}
      </span>

      <span className="t-display-xs text-ink-primary capability-title">{capability.title}</span>
      <span className="t-sm text-ink-secondary capability-body">{capability.body}</span>

      <ArrowRight size={16} className="capability-arrow" />
    </Link>
  );
}
