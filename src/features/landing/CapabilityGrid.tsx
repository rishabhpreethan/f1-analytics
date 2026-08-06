import { Link } from 'react-router';
import { ArrowRight } from '@/components/ui/icons';
import { useSectionReveal } from '@/lib/motion/scroll';
import { useSpotlight } from '@/lib/motion/interactions';

/**
 * Section B — the capability grid (Design Spec §3.4).
 *
 * Six cards, one per destination, each the whole card as a single `<a>` so the hit area is the
 * card rather than the title. The `IN BUILD` chip is present **only while the destination is a
 * placeholder** and disappears with the feature that replaces it — a chip that outlives its
 * reason is worse than no chip.
 *
 * Motion: **G-15** reveals the section once on scroll with the cards staggered, and **G-8** gives
 * each card a pointer spotlight. Both are absent under reduced motion, and the card's hover still
 * changes surface, edge and arrow colour, because that half is a CSS transition. §10 is explicit
 * that no G-8 spotlight may carry information: everything it expresses is also expressed by a
 * token change that `:focus-visible` triggers, so a keyboard user is never shown less.
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
  const { scope, handlers } = useSpotlight<HTMLAnchorElement>();

  return (
    <Link ref={scope} to={capability.to} className="capability-card" {...handlers}>
      <span className="capability-edge" aria-hidden="true" />

      <span className="capability-head">
        <span className="capability-index t-mono t-display-md text-accent-ink">
          {capability.index}
        </span>
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
