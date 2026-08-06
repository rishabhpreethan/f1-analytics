import type { ReactNode } from 'react';

/**
 * The one anatomy behind all five states (`DESIGN_SYSTEM.md` §7.4): a 40px icon tile,
 * a title at `--display-xs`, body at `--text-base` `--ink-secondary`, an action row and
 * an optional mono code chip. It exists so the five read as one family rather than five
 * one-offs, and so the 404 state is not a special case.
 *
 * `tone` is `neutral` or `critical` only. A missing-coverage boundary is a property of
 * the sport's history, not a fault, and must never be painted critical (§3.4.3) — which
 * is why the tone is a prop rather than something each caller styles.
 */

export interface StateCardProps {
  /** Rendered inside the 40px tile. Omit for the states that have no tile. */
  icon?: ReactNode;
  tone?: 'neutral' | 'critical';
  title: string;
  children?: ReactNode;
  /** The mono chip, e.g. `DATABASE_UNAVAILABLE`. */
  code?: string;
  action?: ReactNode;
  /** Headings must nest correctly: inside `main` the state card owns the `h1`. */
  as?: 'h1' | 'h2';
}

export function StateCard({
  icon,
  tone = 'critical',
  title,
  children,
  code,
  action,
  as = 'h1',
}: StateCardProps) {
  const Heading = as;
  return (
    <div className="state-card flex flex-col items-start gap-3 p-4 md:gap-4 md:p-6">
      {icon !== undefined && (
        <span
          className={
            tone === 'neutral' ? 'state-card-tile state-card-tile-neutral' : 'state-card-tile'
          }
        >
          {icon}
        </span>
      )}

      <Heading className="t-display-xs text-ink-primary">{title}</Heading>

      {children !== undefined && (
        <div className="t-base text-ink-secondary flex flex-col gap-3">{children}</div>
      )}

      {(action !== undefined || code !== undefined) && (
        <div className="flex flex-wrap items-center gap-3">
          {action}
          {code !== undefined && <span className="chip t-mono t-xs">{code}</span>}
        </div>
      )}
    </div>
  );
}
