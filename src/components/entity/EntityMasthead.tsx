import type { CSSProperties, ReactNode } from 'react';
import { LoadingState } from '@/components/ui/LoadingState';
import { cssVar, identityToken } from '@/lib/entityColor';
import { EntityPortrait } from './EntityPortrait';

/**
 * **The masthead every entity page wears** — `DESIGN_SYSTEM.md` §6.6.2.1.
 *
 * One component for driver, team and circuit, because the largest risk in shipping three page types
 * at once is three pages that look like three products. What differs between them is data, not
 * anatomy: an eyebrow, a name at display size with its identity beside it, a meta line of facts,
 * and a third part that is the page's own moment (the ribbon, or the locator).
 *
 * **It never depends on anything below it.** The same rule the race and season mastheads follow:
 * *no failure or absence further down the page can blank the top of it*. A driver with no lap data,
 * a team with no constructors' championship and a circuit that hosted one race in 1959 all get a
 * complete header, and the reduced content sits underneath.
 *
 * **A missing code renders no badge at all** (§6.6.2.1). `abbreviation` covers 107 of 881 drivers,
 * so an empty or `—` badge would be the common case and would state a fact about our source rather
 * than about the driver. The surname is already the headline; nothing is lost.
 */

export interface MastheadFact {
  /** Screen-reader label. Not rendered visually — the meta line is read as a sequence of facts. */
  label: string;
  value: ReactNode;
  /** `true` for a figure, which sets it in the mono (§2.4). */
  mono?: boolean;
}

export interface EntityMastheadProps {
  eyebrow: string;
  /** The `h1`. `null` while the query is in flight. */
  name: string | null;
  /** `id` for the `aria-labelledby` on the section. */
  titleId: string;
  /** The real code, where the entity has one. Never derived (§6.5.4a). */
  code?: string | null;
  /** Colours the identity bar, the swatch and the portrait. `null` for a circuit. */
  teamReference?: string | null;
  /** Which monogram rule the portrait falls back to. Omit to render no portrait. */
  portrait?: 'driver' | 'team';
  facts: readonly MastheadFact[];
  /** The page's own moment — the career ribbon, or the circuit locator. */
  children?: ReactNode;
  /** A back link, e.g. to the index the reader came from. */
  action?: ReactNode;
  pending?: boolean;
}

export function EntityMasthead({
  eyebrow,
  name,
  titleId,
  code,
  teamReference = null,
  portrait,
  facts,
  children,
  action,
  pending = false,
}: EntityMastheadProps) {
  const identity =
    teamReference === null
      ? undefined
      : ({ '--identity': cssVar(identityToken(teamReference)) } as CSSProperties);

  return (
    <section className="entity-masthead" aria-labelledby={titleId} style={identity}>
      <div className="entity-masthead-head">
        <p className="season-eyebrow">
          <span className="accent-rule" aria-hidden="true" />
          {eyebrow}
        </p>

        <div className="entity-headline mt-3">
          {action}
          {portrait !== undefined && name !== null && (
            <EntityPortrait
              teamReference={teamReference}
              code={code ?? null}
              name={name}
              kind={portrait}
            />
          )}

          <div className="entity-name-group">
            {name === null ? (
              <h1 id={titleId} className="entity-name" aria-busy="true">
                <LoadingState announce={false} className="skeleton-entity-name" />
              </h1>
            ) : (
              <h1 id={titleId} className="entity-name">
                {name}
              </h1>
            )}

            {/*
             * The code sits beside the name rather than inside it, so a screen reader reads the
             * heading as the name and meets the code as a separate token — `VER` announced inside
             * an `h1` reads as three letters mid-sentence.
             */}
            {code !== null && code !== undefined && code !== '' && (
              <span className="entity-code t-mono">{code}</span>
            )}
          </div>
        </div>

        {pending ? (
          <p className="entity-meta mt-2" aria-hidden="true">
            <LoadingState announce={false} className="skeleton-title-detail" />
          </p>
        ) : (
          facts.length > 0 && (
            <p className="entity-meta t-sm text-ink-secondary mt-2">
              {facts.map((fact) => (
                <span key={fact.label} className={fact.mono === true ? 't-mono' : undefined}>
                  <span className="sr-only">{`${fact.label}: `}</span>
                  {fact.value}
                </span>
              ))}
            </p>
          )
        )}
      </div>

      {children}
    </section>
  );
}
